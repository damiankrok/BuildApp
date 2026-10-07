/**
 * BUILDPLAN-ANALYZER-005I §42 — the boundary bake-off is research, and production cannot reach it.
 *
 * Track B ran DeepLSD, ELSED and MobileSAM beside BuildPlan's own source-cv under
 * `research/analyzer-005i-boundary-bakeoff/`, with Python, PyTorch and OpenCV in a virtual environment outside the
 * repository. None of it may become a production dependency by accident:
 *
 *  - no production source (packages' and apps' `src` and `scripts`, the apps' bundler configs, the Android app's Kotlin
 *    and Gradle) imports or names anything
 *    under `research/`, or names DeepLSD, ELSED, MobileSAM / Segment Anything, PyTorch or a Python runtime in code;
 *  - `research/` is no npm workspace, and neither the type check nor the test runner collects it;
 *  - the repository tracks no model checkpoint (`.pt`, `.pth`, `.ckpt`, `.safetensors`) anywhere, and the research
 *    harness tracks no binary at all — its checkpoints are pinned by SHA-256 and fetched outside the repository;
 *  - the Android build declares no Python, PyTorch or OpenCV dependency and packages no research asset.
 *
 * With the harness present and not invoked, the production analyzer is the same code: nothing it imports changed for
 * Track B (`git diff` of Track B touches only `research/` and `stage-reports/`), which the matrix rows' hashes show.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ')
const importsOf = (source: string): string[] => [...source.matchAll(/(?:^\s*(?:import|export)[^'"]*?from\s+|import\(\s*|require\(\s*)['"]([^'"]+)['"]/gm)].map((m) => m[1])

function filesUnder(dir: string, ext: RegExp): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (['node_modules', 'dist', 'build', '.gradle', '.cxx', 'third_party'].includes(name)) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(relative(ROOT, p))
    }
  }
  walk(abs)
  return out.sort()
}

const productionSources = (): string[] => [
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}/src`, /\.(ts|tsx|mjs|js)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}/src`, /\.(ts|tsx|mjs|js)$/)),
  // post-review E8: the runners too — the blind round runs `packages/analysis-service/scripts/second-house.ts`, and a
  // bundler config under an app's scripts could alias research in.
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}/scripts`, /\.(ts|tsx|mjs|js|cjs)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}/scripts`, /\.(ts|tsx|mjs|js|cjs)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}`, /^(vite|vitest|rollup|esbuild|webpack)\.config\.(ts|mjs|js|cjs)$/)),
  // post-review C3: the build scripts that decide what enters the bundle and the APK
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}`, /^build\.(mjs|js|cjs|ts)$/)),
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}`, /^build\.(mjs|js|cjs|ts)$/)),
  ...filesUnder('apps/android/app/src/main', /\.(kt|java)$/),
  ...filesUnder('apps/android', /\.gradle\.kts$/),
]

/** What the research harness runs, by name, in code (comments removed). */
const RESEARCH_PROVIDER = /deeplsd|\belsed\b|mobile_?sam|segment[-_ ]?anything|\btorch\b|pytorch|\bcv2\b|import\s+numpy|python3?\b/i

describe('§42 production cannot reach the boundary bake-off', () => {
  it('no production source imports or names anything under research/', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/(^|\/)research\//.test(spec) || /boundary-bakeoff/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/research\/analyzer-005i|boundary-bakeoff/.test(codeOf(text))) offenders.push(`${f} names the bake-off`)
    }
    expect(offenders).toEqual([])
  })

  it('no production source names DeepLSD, ELSED, MobileSAM, PyTorch, OpenCV-for-Python or a Python runtime in code', () => {
    const offenders = productionSources().filter((f) => RESEARCH_PROVIDER.test(codeOf(read(f))))
    expect(offenders).toEqual([])
  })

  it('research/ is no workspace, and neither the type check nor the test runner collects it', () => {
    const workspaces = (JSON.parse(read('package.json')) as { workspaces: string[] }).workspaces
    expect(workspaces.some((w) => w.startsWith('research'))).toBe(false)
    expect(JSON.stringify(JSON.parse(read('tsconfig.json')).include)).not.toMatch(/research/)
    expect(read('vitest.config.ts')).not.toMatch(/['"`]research\//)
    // and no production package, app or the root declares a research package or a Python bridge as a dependency
    const manifests = ['package.json', ...readdirSync(join(ROOT, 'packages')).map((p) => `packages/${p}/package.json`), ...readdirSync(join(ROOT, 'apps')).map((a) => `apps/${a}/package.json`)]
    for (const file of manifests) {
      if (!existsSync(join(ROOT, file))) continue
      const pkg = JSON.parse(read(file)) as Record<string, Record<string, string> | undefined>
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })
      expect(deps.filter((d) => /research|bakeoff|pytorch|torch|opencv|python|deeplsd|elsed|sam\b/i.test(d)), file).toEqual([])
    }
  })

  it('no model checkpoint is tracked anywhere, and the research harness tracks no binary', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    // post-review C3: DeepLSD's own checkpoints are `.tar`; `.bin` is checked outside the byte cache BUILDAPP-03R
    // committed (`.cache/source-bytes`, publisher bytes from before the rule, no model among them).
    expect(tracked.filter((f) => /\.(pt|pth|ckpt|safetensors|onnx|ort|npz|npy|tflite|tar|pkl|h5|pb|gguf)$/i.test(f))).toEqual([])
    expect(tracked.filter((f) => /\.bin$/i.test(f) && !f.startsWith('.cache/source-bytes/'))).toEqual([])
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005i-boundary-bakeoff/'))
    expect(harness.filter((f) => !/\.(py|ts|mjs|cjs|js|json|md|txt|sh|cpp|h|hpp|cmake|toml|cfg|ya?ml|csv)$|(^|\/)(CMakeLists\.txt|\.gitignore)$/i.test(f))).toEqual([])
  })

  it('the Android build declares no Python, PyTorch or OpenCV dependency and packages nothing from research/', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      const gradle = codeOf(read(f))
      expect(gradle, f).not.toMatch(/pytorch|torch|opencv|chaquopy|python|deeplsd|elsed|mobilesam|research\//i)
    }
    const assets = filesUnder('apps/android/app/src/main/assets', /.*/)
    expect(assets.filter((a) => /deeplsd|elsed|mobile_?sam|\.pt$|\.pth$|\.ckpt$/i.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005J — the floor-plan intelligence audit is research too. It ran small VLMs (Florence-2,
 * SmolVLM2, Moondream), two wall networks and a micro-referee pilot from `research/analyzer-005j/`, in virtual
 * environments outside the repository, on publisher drawings read locally. What the repository may keep is code and
 * text: no model, no rendered question image and no publisher pixel.
 */
describe('005J production cannot reach the floor-plan intelligence audit, and the audit commits no pixels', () => {
  const AUDIT = /research\/analyzer-005j|florence-?2|smolvlm|moondream|micro[-_]?referee|wall[-_]?referee|vrgen/i

  it('no production source imports research/analyzer-005j or names the audited models in code', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005j/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (AUDIT.test(codeOf(text))) offenders.push(`${f} names the 005J audit`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005J harness and artifacts track only code and text — no image, model or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const audit = tracked.filter((f) => f.startsWith('research/analyzer-005j/') || f.startsWith('stage-reports/artifacts/analyzer-005j/'))
    expect(audit.filter((f) => !/\.(py|ts|cjs|json|md|txt)$/i.test(f))).toEqual([])
    for (const f of audit) {
      const text = read(f)
      // the question corpus records crops by coordinates and hashes only; pixels would arrive as an embedded data URL,
      // a base64 image signature (PNG, JPEG, WebP, GIF), any long base64 run, or a long flat array of numbers (a mask)
      // (a signature alone may appear in prose, e.g. a review describing this test; an image is the signature plus its payload)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the Android build packages nothing from the 005J audit', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(AUDIT)
    }
    const assets = filesUnder('apps/android/app/src/main/assets', /.*/)
    expect(assets.filter((a) => AUDIT.test(a) || (/\.(onnx|ort|gguf|mf\.gz|safetensors|tflite|litertlm|bin|npz|npy|pkl|pt|pth)$/i.test(a) && !/numeric-recogniser|ppocr|paddle/i.test(a)))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005K — the fresh-sheet gap set and its harness are research. The harness (`research/analyzer-005k/`)
 * draws sheets, extracts each WEAK gap with the frozen analyzer, composes the crops a reviewer labels and scores the rule,
 * all on publisher drawings read locally and kept outside the repository. What the repository may keep is code and text:
 * gap ids, coordinates, crop rectangles and the SHA-256 of the bytes and masks — never a crop, a sheet or an overlay.
 */
describe('005K production cannot reach the gap-set harness, and the gap set commits no pixels', () => {
  const HARNESS = /research\/analyzer-005k|gap-set-labels|gap-set-manifest/i

  it('no production source imports research/analyzer-005k or names the gap set', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005k/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005K gap set`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005K harness and artifacts track only code and text — no crop, sheet, overlay or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005k/') || f.startsWith('stage-reports/artifacts/analyzer-005k/'))
    expect(harness.filter((f) => !/\.(py|ts|mjs|cjs|json|ndjson|md|txt|sh)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the Android build packages nothing from the 005K gap set', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
    }
    expect(filesUnder('apps/android/app/src/main/assets', /.*/).filter((a) => HARNESS.test(a) || /gap-set|analyzer-005k/i.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005L — the storey-registration harness (`research/analyzer-005l/`) traces the layout pass on
 * development rows, replays the development matrix, and draws plans with their registrations for a developer to look
 * at — outside the repository. What the repository keeps is code and text: frame and region ids, rectangles, scales,
 * scores and areas. Never a plan, an overlay or a picture of one.
 */
describe('005L production cannot reach the storey-registration harness, and it commits no pixels', () => {
  const HARNESS = /research\/analyzer-005l|storey-trace|baseline-storey-registration/i

  it('no production source imports research/analyzer-005l or names its traces', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005l/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005L harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005L harness and artifacts track only code and text — no plan, overlay or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005l/') || f.startsWith('stage-reports/artifacts/analyzer-005l/'))
    expect(harness.filter((f) => !/\.(ts|mjs|json|ndjson|md|txt)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the harness writes its pictures outside the repository only', () => {
    for (const f of ['research/analyzer-005l/look.ts', 'research/analyzer-005l/pair.ts', 'research/analyzer-005l/storey-trace.ts']) {
      expect(read(f), f).toMatch(/startsWith\('\/home\/user\/BuildApp'\)\) throw new Error\('pictures stay outside the repository'\)/)
    }
  })

  it('the Android build packages nothing from the 005L harness', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
    }
    expect(filesUnder('apps/android/app/src/main/assets', /.*/).filter((a) => HARNESS.test(a) || /analyzer-005l/i.test(a))).toEqual([])
  })
})
